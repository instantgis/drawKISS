import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { Database } from '../types/drawkiss';

export type ImageRow = Database['drawkiss']['Tables']['images']['Row'];
export type ImageInsert = Database['drawkiss']['Tables']['images']['Insert'];
export type LayerRow = Database['drawkiss']['Tables']['layers']['Row'];
export type LayerInsert = Database['drawkiss']['Tables']['layers']['Insert'];
export type CategoryRow = Database['drawkiss']['Tables']['categories']['Row'];

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient<Database>;
  
  // Current image being edited
  currentImage = signal<ImageRow | null>(null);
  currentLayers = signal<LayerRow[]>([]);
  
  // Loading states
  isLoading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    this.supabase = createClient<Database>(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  /**
   * Upload a raw image to storage and create database record.
   */
  async uploadRawImage(file: Blob, title?: string, categoryId?: string | null): Promise<ImageRow> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const id = crypto.randomUUID();
      const rawPath = `raw/${id}.png`;

      // Upload to storage
      const { error: uploadError } = await this.supabase.storage
        .from('drawkiss')
        .upload(rawPath, file, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      // Get image dimensions (approximate from blob size for now)
      const fileSizeBytes = file.size;

      // Create database record
      const imageData: ImageInsert = {
        id,
        raw_path: rawPath,
        title: title || `Capture ${new Date().toLocaleDateString()}`,
        date_taken: new Date().toISOString(),
        file_size_bytes: fileSizeBytes,
        category_id: categoryId ?? undefined
      };
      
      const { data, error: insertError } = await this.supabase
        .schema('drawkiss')
        .from('images')
        .insert(imageData)
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      this.currentImage.set(data);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Upload failed';
      this.error.set(message);
      throw e;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Upload a processed layer and create database record.
   */
  async uploadLayer(
    imageId: string,
    file: Blob,
    type: string,
    paramValue: number,
    name?: string
  ): Promise<LayerRow> {
    this.isLoading.set(true);
    
    try {
      const id = crypto.randomUUID();
      const storagePath = `layers/${id}.png`;
      
      // Upload to storage
      const { error: uploadError } = await this.supabase.storage
        .from('drawkiss')
        .upload(storagePath, file, { contentType: 'image/png' });
      
      if (uploadError) throw uploadError;
      
      // Get current layer count for ordering
      const currentLayers = this.currentLayers();
      const maxOrder = currentLayers.reduce((max, l) => Math.max(max, l.layer_order || 0), 0);
      
      // Create database record
      const layerData: LayerInsert = {
        id,
        image_id: imageId,
        storage_path: storagePath,
        type,
        param_value: paramValue,
        name: name || `${type} (${paramValue})`,
        layer_order: maxOrder + 1,
        visible: true,
        opacity: 100
      };
      
      const { data, error: insertError } = await this.supabase
        .schema('drawkiss')
        .from('layers')
        .insert(layerData)
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Update local state
      this.currentLayers.update(layers => [...layers, data]);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Layer upload failed';
      this.error.set(message);
      throw e;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Get public URL for a storage path.
   */
  getPublicUrl(path: string): string {
    const { data } = this.supabase.storage.from('drawkiss').getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Get thumbnail URL using Supabase image transformations.
   * Requires Pro Plan. Falls back to raw image if transforms not available.
   */
  getThumbnailUrl(path: string, width = 300, height = 225): string {
    const { data } = this.supabase.storage.from('drawkiss').getPublicUrl(path, {
      transform: {
        width,
        height,
        resize: 'cover'
      }
    });
    return data.publicUrl;
  }

  /**
   * Load an image with its layers.
   */
  async loadImage(imageId: string): Promise<void> {
    this.isLoading.set(true);

    try {
      // Load image
      const { data: image, error: imageError } = await this.supabase
        .schema('drawkiss')
        .from('images')
        .select()
        .eq('id', imageId)
        .single();

      if (imageError) throw imageError;
      this.currentImage.set(image);

      // Load layers
      const { data: layers, error: layersError } = await this.supabase
        .schema('drawkiss')
        .from('layers')
        .select()
        .eq('image_id', imageId)
        .order('layer_order', { ascending: true });

      if (layersError) throw layersError;
      this.currentLayers.set(layers || []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Load failed';
      this.error.set(message);
      throw e;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Update grid settings for an image.
   */
  async updateGridSettings(imageId: string, gridRows: number, gridCols: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .schema('drawkiss')
        .from('images')
        .update({ grid_rows: gridRows, grid_cols: gridCols })
        .eq('id', imageId);

      if (error) throw error;

      // Update local state if this is the current image
      const current = this.currentImage();
      if (current?.id === imageId) {
        this.currentImage.set({ ...current, grid_rows: gridRows, grid_cols: gridCols });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save grid settings';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Get images with pagination, optionally filtered by category.
   */
  async getImages(options: {
    categoryId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ images: ImageRow[]; hasMore: boolean }> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    this.isLoading.set(true);

    try {
      let query = this.supabase
        .schema('drawkiss')
        .from('images')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (options.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const images = data || [];
      const hasMore = count !== null && offset + images.length < count;

      return { images, hasMore };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load images';
      this.error.set(message);
      throw e;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Get all images (legacy, no pagination).
   */
  async getAllImages(categoryId?: string): Promise<ImageRow[]> {
    const result = await this.getImages({ categoryId, limit: 1000 });
    return result.images;
  }

  /**
   * Get all categories.
   */
  async getCategories(): Promise<CategoryRow[]> {
    try {
      const { data, error } = await this.supabase
        .schema('drawkiss')
        .from('categories')
        .select()
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load categories';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Create a new category.
   */
  async createCategory(name: string): Promise<CategoryRow> {
    try {
      const { data, error } = await this.supabase
        .schema('drawkiss')
        .from('categories')
        .insert({ name })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create category';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Update image category.
   */
  async updateImageCategory(imageId: string, categoryId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .schema('drawkiss')
        .from('images')
        .update({ category_id: categoryId })
        .eq('id', imageId);

      if (error) throw error;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update category';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Update image title.
   */
  async updateImageTitle(imageId: string, title: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .schema('drawkiss')
        .from('images')
        .update({ title })
        .eq('id', imageId);

      if (error) throw error;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update title';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Delete a single layer (storage + database).
   */
  async deleteLayer(layerId: string): Promise<void> {
    try {
      // Get layer to find storage path
      const { data: layer, error: layerError } = await this.supabase
        .schema('drawkiss')
        .from('layers')
        .select()
        .eq('id', layerId)
        .single();

      if (layerError) throw layerError;

      // Delete from storage
      if (layer?.storage_path) {
        await this.supabase.storage.from('drawkiss').remove([layer.storage_path]);
      }

      // Delete from database
      const { error: deleteError } = await this.supabase
        .schema('drawkiss')
        .from('layers')
        .delete()
        .eq('id', layerId);

      if (deleteError) throw deleteError;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete layer';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Delete an image and all its layers (storage + database).
   */
  async deleteImage(imageId: string): Promise<void> {
    this.isLoading.set(true);

    try {
      // 1. Get the image to find its raw_path
      const { data: image, error: imageError } = await this.supabase
        .schema('drawkiss')
        .from('images')
        .select()
        .eq('id', imageId)
        .single();

      if (imageError) throw imageError;

      // 2. Get all layers for this image
      const { data: layers, error: layersError } = await this.supabase
        .schema('drawkiss')
        .from('layers')
        .select()
        .eq('image_id', imageId);

      if (layersError) throw layersError;

      // 3. Delete layer files from storage
      if (layers && layers.length > 0) {
        const layerPaths = layers.map(l => l.storage_path);
        await this.supabase.storage.from('drawkiss').remove(layerPaths);
      }

      // 4. Delete the raw image from storage
      if (image?.raw_path) {
        await this.supabase.storage.from('drawkiss').remove([image.raw_path]);
      }

      // 5. Delete layers from database (foreign key cascade should handle this, but be explicit)
      await this.supabase
        .schema('drawkiss')
        .from('layers')
        .delete()
        .eq('image_id', imageId);

      // 6. Delete the image from database
      const { error: deleteError } = await this.supabase
        .schema('drawkiss')
        .from('images')
        .delete()
        .eq('id', imageId);

      if (deleteError) throw deleteError;

    } catch (e) {
      const message = e instanceof Error ? e.message : 'Delete failed';
      this.error.set(message);
      throw e;
    } finally {
      this.isLoading.set(false);
    }
  }
}

