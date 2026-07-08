"use client";

import { createClient } from "@butterbase/sdk";

export const butterbase = createClient({
  appId: process.env.NEXT_PUBLIC_BUTTERBASE_APP_ID!,
  apiUrl: process.env.NEXT_PUBLIC_BUTTERBASE_API_URL!,
});

export interface AnalysisRow {
  id: string;
  user_id: string;
  idea: string;
  target_customer: string;
  differentiator: string;
  status: string;
  summary: string | null;
  graph: unknown;
  evidence: unknown;
  created_at: string;
}
