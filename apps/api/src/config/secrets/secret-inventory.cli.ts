#!/usr/bin/env node
import { buildSecretInventory, formatSecretInventoryReport } from './secret-inventory.js';

process.stdout.write(formatSecretInventoryReport(buildSecretInventory()));
