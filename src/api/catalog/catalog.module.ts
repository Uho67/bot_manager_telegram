import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { ProductService } from './product.service';

@Module({
	providers: [CategoryService, ProductService],
	exports: [CategoryService, ProductService],
})
export class CatalogModule { }
