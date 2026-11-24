// Shared renderer-independent operations compiled for the standalone process.
export { buildBookStructure } from '../client/infrastructure/bookStructure.js';
export { readEpubArchive } from '../client/infrastructure/epubArchive.js';
export { parseTxt, projectEpubBook } from '../client/infrastructure/epubParser.js';
export { retainEpubLocations } from '../client/infrastructure/epubCompatibility.js';
export { buildNotesMarkdown, buildChapterDocuments, buildSelectiveBackup } from '../client/infrastructure/exporters.js';
export { withExportImages } from '../client/infrastructure/epubExport.js';
export { buildGoalGraphsForBooks } from '../client/infrastructure/goalLibraryRepository.js';
export { goalAncestors, goalArea, goalEditable, operateGoal } from '../client/domain/goalLifecycle.js';
export { addGoal, changeGoal, goalChildren } from '../client/domain/goalEngine.js';
export { addGoalInput, changeGoalInput, deleteGoalInput, addGoalSource, goalContent, responseContent, setGoalResponse } from '../client/domain/goalContentEngine.js';
export { createAnnotationObject, normalizeAnnotation } from '../client/domain/annotationEngine.js';
export { preparePublicationContent } from '../client/features/reader/publicationContent.js';
export { readSourceText } from '../client/features/reader/annotationRenderer.js';
