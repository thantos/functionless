import "jest";
import fs from "fs";
import path from "path";
import ts from "typescript";
import { ErrorCode, ErrorCodes } from "../src";
import { makeFunctionlessChecker } from "../src/checker";
import { formatDiagnosticsWithColorAndContext } from "../src/format-error";
import { validate } from "../src/validate";

const testFilesDir = path.resolve(path.join(__dirname, "test-files"));

const tsconfig = {};
const compilerHost = ts.createCompilerHost(tsconfig, true);

const fileNames = fs
  .readdirSync(testFilesDir)
  .map((fileName) => path.join(testFilesDir, fileName));

const program = ts.createProgram(fileNames, tsconfig, compilerHost);

const checker = makeFunctionlessChecker(program.getTypeChecker());

test("api-gateway.ts", () => runTest("api-gateway.ts"));

test("step-function.ts", () => runTest("step-function.ts"));

test("function.ts", () => runTest("function.ts"));

test("appsync.ts", () => runTest("appsync.ts"));

test("event-bus.ts", () => runTest("event-bus.ts"));

const skipErrorCodes: ErrorCode[] = [
  // not possible to test, not validated for
  ErrorCodes.FunctionDecl_not_compiled_by_Functionless,
  // dynamic validation - lambda closure serialize poison pill
  ErrorCodes.Function_Closure_Serialization_Incomplete,
  // generic - unexpected error
  ErrorCodes.Unexpected_Error,
  // dynamic validation - wrong step function import type
  ErrorCodes.Incorrect_StateMachine_Import_Type,
  // dynamic validation - unsafe use of secrets
  ErrorCodes.Unsafe_use_of_secrets,
  // generic - unsupported feature
  ErrorCodes.Unsupported_Feature,
  // generic
  ErrorCodes.Invalid_Input,
  // hard to validate, will be supported later
  ErrorCodes.Classes_are_not_supported,
  // Deprecated - No longer used
  ErrorCodes.StepFunction_invalid_filter_syntax,
  // will not support integration specific validation, for now.
  ErrorCodes.Unsupported_AWS_SDK_in_Resource,
  // will not support integration specific validation, for now.
  ErrorCodes.Step_Function_Retry_Invalid_Input,
];

const file: string | undefined = fs
  .readFileSync(
    path.resolve(__dirname, "./__snapshots__/validate.test.ts.snap")
  )
  .toString("utf8");

/**
 * Test for recorded validations of each error code.
 * 1. Checks if there is a validation for an error code.
 * 2. Checks if there is a test for the validation of the error code.
 *
 * If the error code cannot be validated or the validation cannot be easily tested, use skipErrorCodes to skip the code.
 */
describe("all error codes tested", () => {
  test.concurrent.each(
    Object.values(ErrorCodes).filter((code) => !skipErrorCodes.includes(code))
  )("$code: $title", async (code) => {
    if (!file?.includes(`${code.code}`)) {
      throw new Error(
        `validate.test.ts does not emit any errors for ${code.title}`
      );
    }
  });

  test.skip.each(skipErrorCodes)("$code: $title", () => {});
});

function runTest(fileName: string) {
  const diagnostics = validate(
    ts,
    checker,
    program.getSourceFile(path.join(testFilesDir, fileName))!
  );
  const errors = normalize(
    formatDiagnosticsWithColorAndContext(diagnostics, compilerHost)
  );
  expect(errors).toMatchSnapshot();
}

function normalize(str: string) {
  return str.replace(
    new RegExp(escapeRegExp(testFilesDir), "g"),
    "<workspace>"
  );
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
