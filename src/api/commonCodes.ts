import { client } from "./client";
import { requestApi } from "./request";
import { ApiResponse } from "../types/api";
import { CommonCode, CommonCodeGroup } from "../types/commonCode";

export const commonCodeApi = {
  getCodes: async (group: CommonCodeGroup): Promise<CommonCode[]> => {
    return requestApi(() =>
      client.get<ApiResponse<CommonCode[]>>(`/common-codes/${group}`)
    );
  },
};
