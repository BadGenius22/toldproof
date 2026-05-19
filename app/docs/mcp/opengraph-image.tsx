import { renderDocsOg, size, contentType } from '../../../lib/docs-og';

export { size, contentType };
export const alt = 'TOLDPROOF docs · MCP integration';

export default function OG() {
  return renderDocsOg('mcp');
}
