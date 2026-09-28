import type { ProviderName, ServiceType } from './common';

export interface ServiceTemplate {
  serviceType: ServiceType;
  provider: ProviderName;
  name: string;
  baseUrl: string;
  models: string[];
}

/** One key of a platform that serves text, image and video writes all three services (ApplyQuickSetup). */
export interface QuickSetupTemplate {
  gateway: string;
  label: string;
  keyUrl: string;
  services: ServiceTemplate[];
}

const ARK = 'https://ark.cn-beijing.volces.com/api/v3';

export const QUICK_SETUP_TEMPLATES: QuickSetupTemplate[] = [
  {
    gateway: 'volcengine-ark',
    label: 'Volcengine Ark',
    keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    services: [
      {
        serviceType: 'text',
        provider: 'volcengine',
        name: 'Doubao Seed (Ark)',
        baseUrl: ARK,
        models: ['doubao-seed-2-1-pro-260915', 'doubao-seed-2-1-turbo-260628'],
      },
      {
        serviceType: 'image',
        provider: 'volcengine',
        name: 'Seedream (Ark)',
        baseUrl: ARK,
        models: ['doubao-seedream-5-0-pro-260628'],
      },
      {
        serviceType: 'video',
        provider: 'volcengine',
        name: 'Seedance (Ark)',
        baseUrl: ARK,
        models: ['doubao-seedance-2-0-260128', 'doubao-seedance-2-5-260628'],
      },
    ],
  },
];

/** Starting points for the manual service dialog: provider base URL and, where stable, a default model. */
export const PROVIDER_PRESETS: Record<ProviderName, { label: string; baseUrl: string; models: Partial<Record<ServiceType, string[]>> }> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: { text: ['gpt-5'], image: ['gpt-image-1'] },
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: { text: ['gemini-2.5-flash'], image: ['gemini-2.5-flash-image'] },
  },
  volcengine: {
    label: 'Volcengine Ark',
    baseUrl: ARK,
    models: {
      text: ['doubao-seed-2-1-pro-260915'],
      image: ['doubao-seedream-5-0-pro-260628'],
      video: ['doubao-seedance-2-0-260128'],
    },
  },
  minimax: { label: 'MiniMax', baseUrl: 'https://api.minimaxi.com/v1', models: {} },
  aliyun: { label: 'Alibaba Bailian', baseUrl: 'https://dashscope.aliyuncs.com/api/v1', models: {} },
  byteplus: { label: 'BytePlus ModelArk', baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3', models: {} },
  modelrunner: { label: 'ModelRunner', baseUrl: 'https://modelrunner.run', models: {} },
};
