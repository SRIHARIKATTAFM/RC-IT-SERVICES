import { footerTemplate } from '../components/footer.js';
import { headerTemplate } from '../components/navigation.js';

export function siteShell(pathName, pageContent) {
  return `${headerTemplate(pathName)}${pageContent}${footerTemplate()}`;
}
