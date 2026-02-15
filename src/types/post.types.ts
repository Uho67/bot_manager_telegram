import { Template } from './template.types';

/**
 * Post data structure from external API
 */
export interface Post {
  id: number;
  name: string;
  description: string;
  image: string | null;
  image_file_id: string | null;
  template_type: string;
  template: Template;
}
