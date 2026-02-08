import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { ProductService } from './product.service';
import { TemplateService } from './template.service';

@Module({
  providers: [CategoryService, ProductService, TemplateService],
  exports: [CategoryService, ProductService, TemplateService],
})
export class CatalogModule {}
