import { apiClient } from "@/api/apis";
import { InfluencerResponse } from "@/api/models/influencers";
import { KnowledgeFile } from "@/api/models/knowledgeFiles";
import { InfluencerServices } from "@/api/services/InfluencerService";
import { FollowServices } from "@/api/services/FollowServices";

import {
  InfluencerDataModel,
  InfluencerSampleModel,
  KnowledgeFileModel,
} from "../models/InfluencerDataModel";

const influencerServices = InfluencerServices(apiClient);
const followServices = FollowServices(apiClient);

const toInfluencerDataModel = (response: InfluencerResponse, existing?: InfluencerDataModel): InfluencerDataModel => ({
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
  earnings: existing?.earnings ?? 0,
  isSelected: existing?.isSelected ?? false,
});

export const InfluencerRepo = () => ({
  getInfluencers: async (): Promise<InfluencerDataModel[]> => {
    try {
      const response: InfluencerResponse[] =
        await influencerServices.getInfluencers();

      return response.map(item => toInfluencerDataModel(item));
    } catch (e) {
      throw e;
    }
  },
  getFollowedInfluencers: async (): Promise<InfluencerDataModel[]> => {
    try {
      const { items } = await followServices.list();
      if (!items.length) return [];

      const results = await Promise.allSettled(
        items.map(async (follow) => {
          const response: InfluencerResponse = await influencerServices.getInfluencer(follow.influencer_id);
          return toInfluencerDataModel(response);
        })
      );

      const fulfilledResults = results.filter(
        (r): r is PromiseFulfilledResult<InfluencerDataModel> => r.status === "fulfilled"
      );

      if (!fulfilledResults.length) {
        throw new Error("Failed to load followed influencers");
      }

      return fulfilledResults.map((r) => r.value);
    } catch (e) {
      throw e;
    }
  },
  getInfluencer: async (influencer_id: string): Promise<InfluencerDataModel> => {
    try {
      const response: InfluencerResponse = await influencerServices.getInfluencer(influencer_id);
      return toInfluencerDataModel(response);
    } catch (e) {
      throw e;
    }
  },
  patchInfluencer: async (
    influencer: InfluencerDataModel,
    prompt_template?: string,
    influencer_agent_id_third_part?: string,
    bio_json?: unknown,
    voice_id?: string,
  ) => {
    try {
      const response: InfluencerResponse = await influencerServices.patchInfluencer(
        influencer.id,
        influencer.name,
        (prompt_template ?? influencer.prompt_template ?? ""),
        (influencer_agent_id_third_part ?? influencer.influencer_agent_id_third_part),
        (bio_json ?? influencer.bio_json),
        (voice_id ?? influencer.voice_id),
      );
      return {
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
        earnings: influencer.earnings,
        isSelected: influencer.isSelected,
      }
    } catch (e) {
      throw e
    }
  },
  listKnowledgeFiles: async (influencer_id: string): Promise<KnowledgeFileModel[]> => {
    try {
      const response: KnowledgeFile[] = await influencerServices.listKnowledgeFiles(influencer_id);
      return response.map((item) => ({
        id: item.id ?? item.file_id ?? 0,
        filename: item.filename,
        file_type: item.file_type,
        file_size_bytes: item.file_size_bytes,
        status: item.status,
        error_message: item.error_message,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
    } catch (e) {
      throw e;
    }
  },
  uploadKnowledgeFile: async (influencer_id: string, file: File): Promise<KnowledgeFileModel> => {
    try {
      const item = await influencerServices.uploadKnowledgeFile(influencer_id, file);
      return {
        id: item.id ?? item.file_id ?? 0,
        filename: item.filename,
        file_type: item.file_type ?? (item.filename.split(".").pop() || "").toLowerCase(),
        file_size_bytes: item.file_size_bytes ?? file.size ?? 0,
        status: item.status,
        error_message: item.error_message ?? null,
        created_at: item.created_at ?? "",
        updated_at: item.updated_at ?? "",
      };
    } catch (e) {
      throw e;
    }
  },
  uploadSample: async (influencer_id: string, file: File): Promise<InfluencerSampleModel> => {
    try {
      const item = await influencerServices.uploadSample(influencer_id, file);
      return {
        id: item.id ?? 0,
        s3_key: item.s3_key,
        original_filename: item.original_filename ?? null,
        content_type: item.content_type ?? null,
        url: item.url ?? null,
        created_at: item.created_at ?? null,
      };
    } catch (e) {
      throw e;
    }
  },
  listSamples: async (influencer_id: string): Promise<InfluencerSampleModel[]> => {
    try {
      const response = await influencerServices.listSamples(influencer_id);
      return response.samples.map((sample) => ({
        id: Number(sample.id) || 0,
        s3_key: sample.s3_key ?? "",
        original_filename: sample.original_filename ?? null,
        content_type: sample.content_type ?? null,
        url: sample.url ?? null,
        created_at: sample.created_at ?? null,
      }));
    } catch (e) {
      throw e;
    }
  },
  deleteKnowledgeFile: async (influencer_id: string, file_id: number): Promise<void> => {
    try {
      await influencerServices.deleteKnowledgeFile(influencer_id, file_id);
    } catch (e) {
      throw e;
    }
  },
})
