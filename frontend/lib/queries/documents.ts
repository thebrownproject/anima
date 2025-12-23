import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Document, DocumentWithExtraction, DocumentStatus } from '@/types/documents'

export async function getDocumentsWithStacks(): Promise<Document[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('documents')
    .select(`
      id,
      filename,
      mime_type,
      file_size_bytes,
      status,
      uploaded_at,
      stack_documents (
        stacks (
          id,
          name
        )
      )
    `)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }

  // Transform the nested structure
  return (data || []).map((doc) => ({
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    file_size_bytes: doc.file_size_bytes,
    status: doc.status as DocumentStatus,
    uploaded_at: doc.uploaded_at,
    stacks: (doc.stack_documents || [])
      .map((sd: { stacks: { id: string; name: string } | null }) => sd.stacks)
      .filter((s): s is { id: string; name: string } => s !== null),
  }))
}

export async function getDocumentWithExtraction(
  documentId: string
): Promise<DocumentWithExtraction | null> {
  const supabase = await createServerSupabaseClient()

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select(`
      id,
      filename,
      mime_type,
      file_size_bytes,
      status,
      uploaded_at,
      file_path,
      stack_documents (
        stacks (
          id,
          name
        )
      )
    `)
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    console.error('Error fetching document:', docError)
    return null
  }

  // Get latest extraction
  const { data: extraction } = await supabase
    .from('extractions')
    .select('id, extracted_fields, confidence_scores, session_id')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get OCR text
  const { data: ocr } = await supabase
    .from('ocr_results')
    .select('raw_text')
    .eq('document_id', documentId)
    .single()

  return {
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    file_size_bytes: doc.file_size_bytes,
    status: doc.status as DocumentStatus,
    uploaded_at: doc.uploaded_at,
    file_path: doc.file_path,
    stacks: (doc.stack_documents || [])
      .map((sd: { stacks: { id: string; name: string } | null }) => sd.stacks)
      .filter((s): s is { id: string; name: string } => s !== null),
    extraction_id: extraction?.id || null,
    extracted_fields: extraction?.extracted_fields || null,
    confidence_scores: extraction?.confidence_scores || null,
    session_id: extraction?.session_id || null,
    ocr_raw_text: ocr?.raw_text || null,
  }
}
