import { apiClient } from "@/api/apis";
import { AdminInfluencerResponse, AdminServices } from "@/api/services/AdminServices";

import { InfluencerDataModel } from "../models/InfluencerDataModel";

const adminServices = AdminServices(apiClient);

const toInfluencerDataModel = (
  response: AdminInfluencerResponse,
  existing?: InfluencerDataModel
): InfluencerDataModel => ({
  id: response.id,
  name: response.display_name,
  username: response.id,
  img: response.photo_url,
  videoUrl: response.video_url,
  prompt_template: response.prompt_template,
  influencer_agent_id_third_part: response.influencer_agent_id_third_part,
  bio_json: response.bio_json,
  voice_id: response.voice_id,
  created_at: response.created_at,
  fp_ref_id: response.fp_ref_id,
  earnings: existing?.earnings ?? 0,
  isSelected: existing?.isSelected ?? false,
});

export const AdminInfluencerRepo = () => ({
  getInfluencers: async (): Promise<InfluencerDataModel[]> => {
    const response = await adminServices.getInfluencers();
    return response.map((item) => toInfluencerDataModel(item));
  },
});
