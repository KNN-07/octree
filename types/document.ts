import { Tables } from '@/database.types';

export type Document = Tables<'generated_documents'> & {
  projects?: {
    id: string;
    title: string;
  } | null;
};
