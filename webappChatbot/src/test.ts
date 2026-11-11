// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

declare const require: {
  context(path: string, deep?: boolean, filter?: RegExp): {
    keys(): string[];
    <T>(id: string): T;
  };
};

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
// Then we find all the tests.
// These directories contain an unimplemented component and an archived report copy.
// Neither is declared in AppModule; keep the test bundle aligned with tsconfig.spec.json.
const context = require.context('./', true, /^(?!.*\/(?:qlist|chat-bot-rpt-old)\/).*\.spec\.ts$/);
// And load the modules.
context.keys().map(context);
