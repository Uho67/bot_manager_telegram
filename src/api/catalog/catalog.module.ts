import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { ProductService } from './product.service';
import { PostService } from './post.service';

@Module({
  providers: [CategoryService, ProductService, PostService],
  exports: [CategoryService, ProductService, PostService],
})
export class CatalogModule { }
