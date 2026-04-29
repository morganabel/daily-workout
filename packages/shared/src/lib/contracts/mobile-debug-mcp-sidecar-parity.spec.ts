import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import {
  MOBILE_DEBUG_MCP_PROTOCOL_VERSION,
  mobileDebugPlatformSchema,
  mobileDebugToolNames,
} from './mobile-debug-mcp';

describe('mobile debug MCP sidecar parity', () => {
  it('keeps sidecar runtime contracts aligned with shared contracts', async () => {
    const sidecarContractsPath = join(
      process.cwd(),
      '../../tools/mobile-debug-mcp/contracts.mjs',
    );
    const sidecar = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import * as contracts from ${JSON.stringify(sidecarContractsPath)};
console.log(JSON.stringify({
  protocolVersion: contracts.PROTOCOL_VERSION,
  toolNames: contracts.toolNames,
  platformOptions: contracts.platformSchema.options,
  helloAcceptsIos: contracts.helloSchema.safeParse({
    type: 'hello',
    token: 'local-debug-token',
    session: {
      sessionId: 'ios-test',
      protocolVersion: contracts.PROTOCOL_VERSION,
      platform: 'ios',
    },
  }).success,
  helloRejectsInvalidPlatform: contracts.helloSchema.safeParse({
    type: 'hello',
    token: 'local-debug-token',
    session: {
      sessionId: 'ios-test',
      protocolVersion: contracts.PROTOCOL_VERSION,
      platform: 'sideways',
    },
  }).success,
  responseAcceptsSuccess: contracts.appResponseSchema.safeParse({
    id: 'request-1',
    ok: true,
    result: { value: 1 },
  }).success,
}));`,
        ],
        { encoding: 'utf8' },
      ),
    );

    expect(sidecar.protocolVersion).toBe(MOBILE_DEBUG_MCP_PROTOCOL_VERSION);
    expect(sidecar.toolNames).toEqual([...mobileDebugToolNames]);
    expect(sidecar.platformOptions).toEqual(mobileDebugPlatformSchema.options);
    expect(sidecar.helloAcceptsIos).toBe(true);
    expect(sidecar.helloRejectsInvalidPlatform).toBe(false);
    expect(sidecar.responseAcceptsSuccess).toBe(true);
  });
});
