let parent;
let tools;

export async function initialize(data) {
  parent = data.parent;
  tools = data.tools;
}

const isBare = (s) => !s.startsWith('.') && !s.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(s);

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const fromTools = typeof context.parentURL === 'string' && context.parentURL.startsWith(tools);
    if (fromTools && isBare(specifier)) {
      return nextResolve(specifier, { ...context, parentURL: parent });
    }
    throw err;
  }
}
