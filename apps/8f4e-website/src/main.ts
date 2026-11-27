import { mountHomepageEditors } from './homepage';

const dispose = mountHomepageEditors();
import.meta.hot?.dispose(dispose);
