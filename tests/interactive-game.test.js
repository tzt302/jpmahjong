import test from 'node:test';
import assert from 'node:assert/strict';
import { FullGameSession } from '../src/full-game.js';

async function waitForDraw(session) {
  for (;;) {
    const decision = await session.waitForDecision();
    if (decision.kind === 'draw') return decision;
    session.submit({});
  }
}

test('interactive session pauses for a legal human discard', async () => {
  const session = new FullGameSession({ rule: { '場数': 0 } }).start();
  try {
    const decision = await waitForDraw(session);
    assert.equal(decision.kind, 'draw');
    assert.ok(decision.options.dapai.length > 0);
    const discard = decision.options.dapai.at(-1);
    session.submit({ dapai: discard });
    const next = await session.waitForDecision();
    assert.ok(['draw', 'discard-response', 'kan-response'].includes(next.kind));
    assert.notEqual(session.human.pending, decision);
  }
  finally {
    session.stop();
  }
});

test('interactive session rejects actions outside the legal option set', async () => {
  const session = new FullGameSession({ rule: { '場数': 0 } }).start();
  try {
    await waitForDraw(session);
    assert.throws(() => session.submit({ gang: 'm1111' }), /非法杠牌/);
  }
  finally {
    session.stop();
  }
});
