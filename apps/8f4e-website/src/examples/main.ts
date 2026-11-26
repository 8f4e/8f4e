import { mountExampleGallery } from '../example-gallery';
import { projectCategories } from './projects';

const dispose = mountExampleGallery('Examples', projectCategories);

import.meta.hot?.dispose(dispose);
