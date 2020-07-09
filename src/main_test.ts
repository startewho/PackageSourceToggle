// Copyright the Browserify authors. MIT License.
// Ported from https://github.com/browserify/path-browserify/ff

import { assertEquals,path } from "./deps.ts";




Deno.test("isAbsolute", function () {
  assertEquals(path.relative("/home/foo","/abc"), "..\\..\\abc");
  
});

