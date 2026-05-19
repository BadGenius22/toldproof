import { renderDocsOg, size, contentType } from '../../../lib/docs-og';

export { size, contentType };
export const alt = 'TOLDPROOF docs · Architecture';

export default function OG() {
  return renderDocsOg('architecture');
}
