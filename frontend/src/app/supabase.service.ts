import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { Database } from '../types/drawkiss';

export type ImageRow = Database['drawkiss']['Tables']['images']['Row'];
export type ImageInsert = Database['drawkiss']['Tables']['images']['Insert'];
export type LayerRow = Database['drawkiss']['Tables']['layers']['Row'];
export type LayerInsert = Database['drawkiss']['Tables']['layers']['Insert'];
export type CategoryRow = Database['drawkiss']['Tables']['categories']['Row'];
export type FilterRow = Database['drawkiss']['Tables']['filters']['Row'];
export type ProgressPhotoRow = Database['drawkiss']['Tables']['progress_photos']['Row'];
export type ProgressPhotoInsert = Database['drawkiss']['Tables']['progress_photos']['Insert'];

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient<Database>;

  // Auth state
  currentUser = signal<User | null>(null);
  session = signal<Session | null>(null);

  // Promise that resolves when initial auth check is complete
  readonly authReady: Promise<void>;

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

    // Initialize auth state and expose promise for guards to await
    this.authReady = this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.session.set(session);
      this.currentUser.set(session?.user ?? null);
    });

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.currentUser.set(session?.user ?? null);
    });
  }

  /**
   * Sign in with email and password.
   */
  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  /**
   * Sign up with email and password.
   */
  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  /**
   * Sign out.
   */
  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Get current user ID (for inserts).
   */
  getUserId(): string | null {
    return this.currentUser()?.id ?? null;
  }

  /**
   * Upload a raw image to storage and create database record.
   */
  async uploadRawImage(file: Blob, title?: string, categoryId?: string | null): Promise<ImageRow> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const userId = this.getUserId();
      if (!userId) throw new Error('Must be logged in to upload');

      const id = crypto.randomUUID();
      const rawPath = `${userId}/raw/${id}.png`;

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
        user_id: userId,
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
   * Get all available filters (system-wide).
   */
  async getFilters(): Promise<FilterRow[]> {
    try {
      const { data, error } = await this.supabase
        .schema('drawkiss')
        .from('filters')
        .select()
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load filters';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Upload a processed layer using filter code (legacy compatibility).
   * Looks up filter_id from code, then calls uploadLayer.
   */
  async uploadLayerByCode(
    imageId: string,
    file: Blob,
    filterCode: string,
    paramValue: number,
    name?: string
  ): Promise<LayerRow> {
    // Look up filter by code
    const { data: filter, error } = await this.supabase
      .schema('drawkiss')
      .from('filters')
      .select()
      .eq('code', filterCode)
      .single();

    if (error || !filter) {
      throw new Error(`Unknown filter code: ${filterCode}`);
    }

    return this.uploadLayer(imageId, file, filter.id, paramValue, name);
  }

  /**
   * Upload a processed layer and create database record.
   */
  async uploadLayer(
    imageId: string,
    file: Blob,
    filterId: string,
    paramValue: number,
    name?: string
  ): Promise<LayerRow> {
    this.isLoading.set(true);

    try {
      const userId = this.getUserId();
      if (!userId) throw new Error('Must be logged in to upload');

      const id = crypto.randomUUID();
      const storagePath = `${userId}/layers/${id}.png`;

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
        user_id: userId,
        image_id: imageId,
        storage_path: storagePath,
        filter_id: filterId,
        param_value: paramValue,
        name: name || `Layer ${maxOrder + 1}`,
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
   * Get signed URL for a storage path (private bucket).
   * URLs expire after 1 hour.
   */
  async getSignedUrl(path: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('drawkiss')
      .createSignedUrl(path, 3600); // 1 hour expiry
    if (error || !data) {
      console.error('Failed to get signed URL:', error);
      return '';
    }
    return data.signedUrl;
  }

  /**
   * Get signed thumbnail URL using Supabase image transformations.
   * URLs expire after 1 hour.
   */
  async getSignedThumbnailUrl(path: string, width = 300, height = 225): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('drawkiss')
      .createSignedUrl(path, 3600, {
        transform: {
          width,
          height,
          resize: 'cover'
        }
      });
    if (error || !data) {
      console.error('Failed to get signed thumbnail URL:', error);
      return '';
    }
    return data.signedUrl;
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
      const userId = this.getUserId();
      if (!userId) throw new Error('Must be logged in to create category');

      const { data, error } = await this.supabase
        .schema('drawkiss')
        .from('categories')
        .insert({ name, user_id: userId })
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

      // 3. Get all progress photos for this image
      const { data: progressPhotos, error: progressError } = await this.supabase
        .schema('drawkiss')
        .from('progress_photos')
        .select()
        .eq('image_id', imageId);

      if (progressError) throw progressError;

      // 4. Delete layer files from storage
      if (layers && layers.length > 0) {
        const layerPaths = layers.map(l => l.storage_path);
        await this.supabase.storage.from('drawkiss').remove(layerPaths);
      }

      // 5. Delete progress photo files from storage
      if (progressPhotos && progressPhotos.length > 0) {
        const progressPaths = progressPhotos.map(p => p.storage_path);
        await this.supabase.storage.from('drawkiss').remove(progressPaths);
      }

      // 6. Delete the raw image from storage
      if (image?.raw_path) {
        await this.supabase.storage.from('drawkiss').remove([image.raw_path]);
      }

      // 7. Delete layers from database (foreign key cascade should handle this, but be explicit)
      await this.supabase
        .schema('drawkiss')
        .from('layers')
        .delete()
        .eq('image_id', imageId);

      // 8. Delete progress photos from database (cascade should handle, but be explicit)
      await this.supabase
        .schema('drawkiss')
        .from('progress_photos')
        .delete()
        .eq('image_id', imageId);

      // 9. Delete the image from database
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

  // ==================== Progress Photos ====================

  /**
   * Upload a progress photo for an image.
   */
  async uploadProgressPhoto(imageId: string, file: Blob, notes?: string): Promise<ProgressPhotoRow> {
    try {
      const userId = this.getUserId();
      if (!userId) throw new Error('Must be logged in to upload');

      const id = crypto.randomUUID();
      const storagePath = `${userId}/progress/${id}.png`;

      // Upload to storage
      const { error: uploadError } = await this.supabase.storage
        .from('drawkiss')
        .upload(storagePath, file, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      // Create database record
      const progressData: ProgressPhotoInsert = {
        id,
        user_id: userId,
        image_id: imageId,
        storage_path: storagePath,
        notes: notes || null,
        is_final: false
      };

      const { data, error: insertError } = await this.supabase
        .schema('drawkiss')
        .from('progress_photos')
        .insert(progressData)
        .select()
        .single();

      if (insertError) throw insertError;
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Progress photo upload failed';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Get all progress photos for an image.
   */
  async getProgressPhotos(imageId: string): Promise<ProgressPhotoRow[]> {
    try {
      const { data, error } = await this.supabase
        .schema('drawkiss')
        .from('progress_photos')
        .select()
        .eq('image_id', imageId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load progress photos';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Get progress photo count for an image.
   */
  async getProgressPhotoCount(imageId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .schema('drawkiss')
        .from('progress_photos')
        .select('*', { count: 'exact', head: true })
        .eq('image_id', imageId);

      if (error) throw error;
      return count || 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Get progress counts for multiple images at once.
   */
  async getProgressPhotoCounts(imageIds: string[]): Promise<Map<string, number>> {
    try {
      const { data, error } = await this.supabase
        .schema('drawkiss')
        .from('progress_photos')
        .select('image_id')
        .in('image_id', imageIds);

      if (error) throw error;

      const counts = new Map<string, number>();
      imageIds.forEach(id => counts.set(id, 0));
      (data || []).forEach(row => {
        counts.set(row.image_id, (counts.get(row.image_id) || 0) + 1);
      });
      return counts;
    } catch (e) {
      return new Map();
    }
  }

  /**
   * Mark a progress photo as final.
   */
  async markProgressPhotoAsFinal(progressId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .schema('drawkiss')
        .from('progress_photos')
        .update({ is_final: true })
        .eq('id', progressId);

      if (error) throw error;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to mark as final';
      this.error.set(message);
      throw e;
    }
  }

  /**
   * Delete a progress photo (storage + database).
   */
  async deleteProgressPhoto(progressId: string): Promise<void> {
    try {
      // Get the progress photo to find storage path
      const { data: photo, error: photoError } = await this.supabase
        .schema('drawkiss')
        .from('progress_photos')
        .select()
        .eq('id', progressId)
        .single();

      if (photoError) throw photoError;

      // Delete from storage
      if (photo?.storage_path) {
        await this.supabase.storage.from('drawkiss').remove([photo.storage_path]);
      }

      // Delete from database
      const { error: deleteError } = await this.supabase
        .schema('drawkiss')
        .from('progress_photos')
        .delete()
        .eq('id', progressId);

      if (deleteError) throw deleteError;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete progress photo';
      this.error.set(message);
      throw e;
    }
  }
}

