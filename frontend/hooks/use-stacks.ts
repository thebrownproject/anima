'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/hooks/use-supabase'
import type { StackSummary } from '@/types/stacks'

/**
 * Client-side hook to fetch active stacks.
 * Returns a list of stack summaries (id + name) for use in filters, dropdowns, etc.
 */
export function useStacks() {
  const [stacks, setStacks] = useState<StackSummary[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useSupabase()

  useEffect(() => {
    let ignore = false

    async function fetchStacks() {
      const { data, error } = await supabase
        .from('stacks')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true })

      if (!ignore) {
        if (!error && data) {
          setStacks(data)
        }
        setLoading(false)
      }
    }
    fetchStacks()

    return () => {
      ignore = true
    }
  }, [supabase])

  return { stacks, loading }
}
