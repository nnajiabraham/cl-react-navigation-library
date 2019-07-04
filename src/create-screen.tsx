import React, { cloneElement } from 'react';
import { getPathname } from './navigator';
import { BasepathContext, NavigationContext } from './navigation-provider';

function createScreen(element: any, active: boolean, path: string) {
  return (
    <BasepathContext.Consumer>
      {basepath => (
        <NavigationContext.Consumer>
          {navigation => {
            const pathname = getPathname(path || '/', basepath);

            // @ts-ignore
            const params = getParams(pathname, navigation.current.path);
            // @ts-ignore
            const query = getQuery(navigation.current.path);

            const props = {
              navigate: function(to: string, state: any) {
                // @ts-ignore
                navigation.navigate(to, basepath, state);
              },
              query,
              active,
              ...params,
            };

            return (
              <BasepathContext.Provider value={pathname}>
                {cloneElement(element, {
                  ...props,
                  ...(navigation ? navigation.current.state : {}),
                })}
              </BasepathContext.Provider>
            );
          }}
        </NavigationContext.Consumer>
      )}
    </BasepathContext.Consumer>
  );
}

export { createScreen };

let paramRe = /^:(.+)/;

function getParams(
  pathname: string,
  location: string
): { [param: string]: string } | undefined {
  let params: { [param: string]: string } | undefined;

  const pathSegments = pathname.split('/');
  const locationSegments = location.split('/');

  for (let i = 0; i < pathSegments.length; i++) {
    const paramsMatch = paramRe.exec(pathSegments[i]);
    if (paramsMatch) {
      if (!params) {
        params = {};
      }

      params[paramsMatch[1]] = locationSegments[i];
    }
  }

  return params;
}

function getQuery(location: string): string {
  const [, query] = location.split('?');
  return query || '';
}