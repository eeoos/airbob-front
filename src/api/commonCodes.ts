import { client } from "./client";
import { ApiResponse } from "../types/api";
import { CommonCode, CommonCodeGroup } from "../types/commonCode";

export const commonCodeApi = {
  getCodes: async (group: CommonCodeGroup): Promise<CommonCode[]> => {
    const response = await client.get<ApiResponse<CommonCode[]>>(
      `/common-codes/${group}`
    );
    return response.data.data || [];
  },
};
