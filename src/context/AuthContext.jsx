import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { isMasterEmail } from '../lib/master'
import { isProfileComplete } from '../lib/profile'
import { isEquipeTipo } from '../lib/tiposConta'

const AuthContext = createContext(null)

async function loadProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }

    try {
      const nextProfile = await loadProfile(userId)
      setProfile(nextProfile)
      return nextProfile
    } catch (error) {
      console.error('Erro ao carregar perfil:', error.message)
      setProfile(null)
      return null
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return undefined
    }

    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setProfile(null)
      return undefined
    }

    let cancelled = false

    loadProfile(userId)
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile)
      })
      .catch((error) => {
        console.error('Erro ao carregar perfil:', error.message)
        if (!cancelled) setProfile(null)
      })

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const user = session?.user ?? null
  const isMaster = profile?.role === 'master' || isMasterEmail(user?.email)
  const isApproved = profile?.status === 'approved' || isMaster
  const isPending = Boolean(user) && !isApproved && profile?.status !== 'rejected'
  const isRejected = profile?.status === 'rejected'
  const isEquipe = Boolean(
    user && isApproved && !isMaster && isEquipeTipo(profile?.tipo_conta),
  )
  const profileComplete = isMaster || isEquipe || isProfileComplete(profile)
  const canUseCotacao = Boolean(user) && !isRejected && isApproved && profileComplete && !isEquipe

  const value = useMemo(
    () => ({
      configured: supabaseConfigured,
      session,
      user,
      profile,
      loading,
      isMaster,
      isEquipe,
      isApproved,
      isPending,
      isRejected,
      profileComplete,
      canUseCotacao,
      refreshProfile: () => refreshProfile(user?.id),
      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      signUp: (email, password) => supabase.auth.signUp({ email, password }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, user, profile, loading, isMaster, isEquipe, isApproved, isPending, isRejected, profileComplete, canUseCotacao, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa estar dentro de AuthProvider')
  }
  return context
}
