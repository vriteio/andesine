#!/usr/bin/env node
import { runCLI } from "./run";

process.exitCode = await runCLI();
