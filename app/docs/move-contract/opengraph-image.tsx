import { renderDocsOg, size, contentType } from '../../../lib/docs-og';

export { size, contentType };
export const alt = 'TOLDPROOF docs · Move contract';

export default function OG() {
  return renderDocsOg('move-contract');
}
