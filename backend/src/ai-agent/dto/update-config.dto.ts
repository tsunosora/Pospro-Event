export class UpdateConfigDto {
  enabled?: boolean;
  chatEnabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  name?: string;
  greeting?: string;
  avatar?: string;
  clearApiKey?: boolean;
}
