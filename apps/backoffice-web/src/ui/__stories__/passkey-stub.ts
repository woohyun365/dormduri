// Story passkeys (design guide ⑨): a story that opens the step after a passkey ceremony answers
// `navigator.credentials.create` with a fake credential and puts it back when the story ends. The fake never reaches
// an API; the story's BFF answers (bff-stub.ts) stand for the API's verdict.
const bytes = (text: string) => new TextEncoder().encode(text).buffer;

function fakeCredential() {
  return {
    id: 'c3RvcnktcGFzc2tleQ',
    rawId: bytes('story-passkey'),
    type: 'public-key',
    authenticatorAttachment: 'platform',
    response: {
      clientDataJSON: bytes('{"type":"webauthn.create"}'),
      attestationObject: bytes('story-attestation'),
      getTransports: () => ['internal'],
    },
    getClientExtensionResults: () => ({}),
  };
}

export function answerPasskeyCreation(): () => void {
  const container = navigator.credentials;
  Object.defineProperty(container, 'create', {
    configurable: true,
    value: async () => fakeCredential(),
  });
  return () => {
    // The own property shadows the prototype's method; removing it brings the browser's back.
    Reflect.deleteProperty(container, 'create');
  };
}
