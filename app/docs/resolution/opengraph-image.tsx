import { renderDocsOg, size, contentType } from '../../../lib/docs-og';

export { size, contentType };
export const alt = 'TOLDPROOF docs · Resolution Agent';

export default function OG() {
  return renderDocsOg('resolution');
}
