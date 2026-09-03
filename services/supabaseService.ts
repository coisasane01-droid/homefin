import { createClient } from '@supabase/supabase-js';
import { AppData, Bill } from '../types';

// NOTE: This file is a template. To use Supabase:
// 1. Install @supabase/supabase-js
// 2. Add your URL and Key to your environment variables
// 3. Swap 'db' imports in components to use this service instead of local storage db.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only create client if credentials exist to prevent immediate errors
export const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

export const supabaseService = {
  getBills: async (month: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('month', month);
    if (error) throw error;
    return data as Bill[];
  },

  addBill: async (bill: Bill) => {
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase.from('bills').insert(bill);
    if (error) throw error;
  },

  updateBill: async (bill: Bill) => {
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase.from('bills').update(bill).eq('id', bill.id);
    if (error) throw error;
  },

  uploadAttachment: async (file: File) => {
    if (!supabase) throw new Error("Supabase not configured");
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('attachments')
      .upload(fileName, file);
    if (error) throw error;
    return data;
  }
};