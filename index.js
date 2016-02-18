'use strict';

var glob = require('glob');
var path = require('path');
var assert = require('assert');
var Ajv = require('ajv');

module.exports = jsonScriptTest;

var ajv = Ajv({ allErrors: true });
ajv.addSchema(require('jsonscript/schema/schema.json'));
var validate = ajv.compile(require('jsonscript-test-suite/test_suite_schema.json'));


function jsonScriptTest(jsInterpreters, opts) {
  skipOrOnly(opts, describe)(opts.description || 'JSONScript tests', function() {
    if (opts.timeout) this.timeout(opts.timeout);
    for (var suiteName in opts.suites)
      addTests(suiteName, opts.suites[suiteName]);
  });


  function addTests(suiteName, testsPath) {
    describe(suiteName, function() {
      var files = getTestFiles(testsPath);

      files.forEach(function (file) {
        var filter = {
          skip: getFileFilter(file, 'skip'),
          only: getFileFilter(file, 'only')
        };

        skipOrOnly(filter, describe)(file.name, function() {
          var testDir = path.dirname(file.path);
          var testSuite = require(file.path);

          var valid = validate(testSuite);
          if (!valid) console.error('Error validating', file.name, '\nErrors:\n', validate.errors);
          assert(valid);


          testSuite.forEach(function (testSet) {
            skipOrOnly(testSet, describe)(testSet.description, function() {
              testSet.tests.forEach(function (test) {
                skipOrOnly(test, it)(test.description, function() {
                  return Array.isArray(jsInterpreters)
                          ? Promise.all(jsInterpreters.map(doTest))
                          : doTest(jsInterpreters);
                });

                function doTest(js) {
                  var data = test.data === undefined ? testSet.data : test.data;
                  var script = test.script === undefined ? testSet.script : test.script;

                  return js.evaluate(script, data)
                  .then(testResult, testException);

                  function testResult(res) {
                    if (test.result) {
                      var method = typeof res == 'object' ? 'deepStrictEqual' : 'strictEqual';
                      try {
                        assert[method](res, test.result);
                        suiteHooks(true, res);
                      } catch(e) {
                        suiteHooks(false, res);
                        throw e;
                      }
                    } else {
                      suiteHooks(false, res);
                      throw new Error('should have failed');
                    }
                  }

                  function testException(err) {
                    if (test.result) {
                      suiteHooks(false, undefined, err);
                      throw err;
                    } else {
                      try {
                        if (test.error !== true)
                          assert.equal(err.message, test.error);
                        suiteHooks(true, undefined, err);
                      } catch(e) {
                        suiteHooks(false, undefined, err);
                        throw e;
                      }
                    }
                  }

                  function suiteHooks(passed, result, error) {
                    var result = {
                      passed: passed,
                      jsInterpreter: js,
                      script: script,
                      data: data,
                      test: test,
                      result: result,
                      error: error
                    };

                    if (opts.afterEach) opts.afterEach(result);
                    if (opts.afterError && !passed) opts.afterError(result);
                  }
                }
              });
            });
          });
        });
      });
    });

    function getFileFilter(file, property) {
      var filter = opts[property];
      return Array.isArray(filter) && filter.indexOf(file.name) >= 0;
    }
  }


  function skipOrOnly(filter, func) {
    return filter.only === true ? func.only : filter.skip === true ? func.skip : func;
  }


  function getTestFiles(testsPath) {
    var files = glob.sync(testsPath, { cwd: opts.cwd });
    return files.map(function (file) {
      var match = file.match(/(\w+\/)\w+\.json/)
      var folder = match ? match[1] : '';
      if (opts.hideFolder && folder == opts.hideFolder) folder = '';
      return {
        path: path.join(opts.cwd, file),
        name: folder + path.basename(file, '.json')
      };
    });
  }
}
