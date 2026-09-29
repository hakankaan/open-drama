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
const MODELARK = 'https://ark.ap-southeast.bytepluses.com/api/v3';

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
  {
    gateway: 'byteplus-modelark',
    label: 'BytePlus ModelArk',
    keyUrl: 'https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey',
    services: [
      {
        serviceType: 'text',
        provider: 'byteplus',
        name: 'Seed (ModelArk)',
        baseUrl: MODELARK,
        models: ['seed-2-0-pro-260328', 'dola-seed-2-1-turbo-260628'],
      },
      {
        serviceType: 'image',
        provider: 'byteplus',
        name: 'Seedream (ModelArk)',
        baseUrl: MODELARK,
        models: ['dola-seedream-5-0-pro-260628', 'dola-seedream-5-0-flash-260915'],
      },
      {
        serviceType: 'video',
        provider: 'byteplus',
        name: 'Seedance (ModelArk)',
        baseUrl: MODELARK,
        models: ['dreamina-seedance-2-0-260128', 'dreamina-seedance-2-5-260628'],
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
  minimax: { label: 'MiniMax', baseUrl: 'https://api.minimaxi.com', models: { video: ['MiniMax-H3'] } },
  aliyun: { label: 'Alibaba Bailian', baseUrl: 'https://dashscope.aliyuncs.com/api/v1', models: { video: ['wan3.0-video'] } },
  byteplus: {
    label: 'BytePlus ModelArk',
    baseUrl: MODELARK,
    models: {
      text: ['seed-2-0-pro-260328'],
      image: ['dola-seedream-5-0-pro-260628'],
      video: ['dreamina-seedance-2-0-260128'],
    },
  },
  modelrunner: { label: 'ModelRunner', baseUrl: 'https://modelrunner.run', models: {} },
};
