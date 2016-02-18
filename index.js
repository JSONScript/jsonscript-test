'use strict';

var glob = require('glob');
var path = require('path');
var assert = require('assert');

module.exports = jsonScriptTest;


function jsonScriptTest(jsInterpreters, opts) {
  skipOrOnly(opts, describe)(opts.description || 'JSON schema tests', function() {
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
        }

        skipOrOnly(filter, describe)(file.name, function() {
          var testDir = path.dirname(file.path);
          var testSuite = require(file.path);

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
                      try { assert[method](res, test.result); }
                      catch(e) { throw e; }
                    } else {
                      throw new Error('should have failed');
                    }


                    // var passed = valid === test.valid;
                    // if (!passed && opts.log !== false)
                    //   console.log('result:', valid, '\nexpected: ', test.valid, '\nerrors:', validator.errors);
                    // if (valid) assert(!errors || errors.length == 0);
                    // else assert(errors.length > 0);

                    // suiteHooks(passed, valid, errors);
                    // assert.equal(valid, test.valid);
                  }

                  function testException(err) {
                    if (test.result) {
                      throw err;
                    } else {
                      try { assert.equal(err.message, test.error); }
                      catch(e) { throw e; }
                    }

                    // var passed = err.message == test.error;
                    // if (!passed && opts.log !== false)
                    //   console.log('error:', err.message,
                    //     '\nexpected: ',
                    //     test.valid ? 'valid'
                    //       : test.valid === false ? 'invalid'
                    //       : 'error ' + test.error);

                    // suiteHooks(passed);
                    // assert.equal(err.message, test.error);
                  }

                  function suiteHooks(passed, valid, errors) {
                    var result = {
                      passed: passed,
                      validator: validator,
                      schema: schema,
                      data: data,
                      valid: valid,
                      expected: test.valid,
                      expectedError: test.error,
                      errors: errors
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
