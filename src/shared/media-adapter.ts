/**
 * Media adapter interfaces — the contract a media type must fulfill
 * to plug into the Proton platform.
 *
 * Each domain (music, comics, papers) implements MediaTypeConfig
 * to describe its columns, sidebar entities, and feature extraction.
 */

/** A single item in the library — the universal record */
export interface MediaItem {
  id: string
  embedded_id: string | null
  file_path: string
  file_name: string
  file_size: number
  title: string | null
  rating: number
  play_count: number
  date_added: string
  date_modified: string
  artwork_path: string | null
  duration: number
}

/** Configuration for a media type adapter */
export interface MediaTypeConfig {
  /** Unique key: 'music', 'comics', 'papers' */
  id: string
  /** Display name in UI */
  label: string
  /** File extensions this adapter handles */
  extensions: Set<string>
  /** Columns shown in the table view */
  columns: ColumnDef[]
  /** Sidebar grouping entities (artist, genre, series, author, etc.) */
  entities: EntityDef[]
  /** Feature extractor for geometric view (optional) */
  featureExtractor?: FeatureExtractorDef
}

/** Definition of a table column */
export interface ColumnDef {
  key: string
  label: string
  width?: string
  align?: 'left' | 'right' | 'center'
  format?: (value: unknown) => string
}

/** Definition of a sidebar entity section */
export interface EntityDef {
  key: string
  label: string
  /** How to query entity list */
  query: 'builtin-junction' | 'metadata-field'
  /** Which metadata field to group by */
  field: string
}

/** Feature extractor configuration for geometric navigation */
export interface FeatureExtractorDef {
  /** Human label */
  label: string
  /** Number of dimensions in the feature vector */
  dimensions: number
  /** Feature group definitions for KNN picker labels */
  featureGroups: FeatureGroup[]
}

/** A named range within the feature vector with human-readable axis labels */
export interface FeatureGroup {
  name: string
  start: number
  end: number
  /** Label when neighbor is higher in this group */
  pos: string
  /** Label when neighbor is lower in this group */
  neg: string
}
