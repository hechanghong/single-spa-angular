import * as webpackMerge from 'webpack-merge';
import * as path from 'path';
import * as fs from 'fs';
import { findUp } from '@angular/cli/utilities/find-up';

export interface DefaultExtraOptions {
  removeMiniCssExtract: boolean;
}
const defaultExtraOptions = {
  removeMiniCssExtract: true,
};

/**
 * The `options` parameter is typed as `any` because it doesn't require
 * installing `@types/webpack-dev-server` and `karma`. If you need to know
 * what properties it might contain if it's not `undefined`,
 * then @see https://github.com/angular/angular-cli/blob/master/packages/angular_devkit/build_angular/src/browser/schema.json
 */
export default (config: any, options?: any, extraOptions?: DefaultExtraOptions) => {
  const libraryName = getLibraryName(options);
  extraOptions = { ...defaultExtraOptions, ...extraOptions };

  const singleSpaConfig: any = {
    output: {
      library: libraryName,
      libraryTarget: options?.customWebpackConfig?.libraryTarget ?? 'umd',
      jsonpFunction: 'webpackJsonp' + libraryName,
    },
    externals: ['zone.js'],
    devServer: {
      historyApiFallback: false,
      contentBase: path.resolve(process.cwd(), 'src'),
      headers: {
        'Access-Control-Allow-Headers': '*',
      },
    },
    module: {
      rules: [
        {
          parser: {
            system: false,
          },
        },
      ],
    },
  };

  const mergedConfig: any = webpackMerge.smart(config, singleSpaConfig);

  if (mergedConfig.output.libraryTarget === 'system') {
    // Don't used named exports when exporting in System.register format.
    delete mergedConfig.output.library;
  }

  removePluginByName(mergedConfig.plugins, 'IndexHtmlWebpackPlugin');
  if (extraOptions.removeMiniCssExtract) {
    removeMiniCssExtract(mergedConfig);
  }

  if (Array.isArray(mergedConfig.entry.styles)) {
    // We want the global styles to be part of the "main" entry. The order of strings in this array
    // matters -- only the last item in the array will have its exports become the exports for the entire
    // webpack bundle
    mergedConfig.entry.main = [...mergedConfig.entry.styles, ...mergedConfig.entry.main];
  }

  // Remove bundles

  // Since Angular 8 supports differential loading it also
  // add `polyfills-es5` to Webpack entries. This is a fix for:
  // https://github.com/single-spa/single-spa-angular/issues/148
  if (mergedConfig.entry['polyfills-es5']) {
    delete mergedConfig.entry['polyfills-es5'];
  }

  delete mergedConfig.entry.polyfills;
  delete mergedConfig.entry.styles;
  delete mergedConfig.optimization.runtimeChunk;
  delete mergedConfig.optimization.splitChunks;

  return mergedConfig;
};

function removePluginByName(plugins: any[], name: string) {
  const pluginIndex = plugins.findIndex(plugin => plugin.constructor.name === name);
  if (pluginIndex > -1) {
    plugins.splice(pluginIndex, 1);
  }
}

function removeMiniCssExtract(config: any) {
  removePluginByName(config.plugins, 'MiniCssExtractPlugin');
  config.module.rules.forEach((rule: any) => {
    if (rule.use) {
      const cssMiniExtractIndex = rule.use.findIndex(
        (use: any) =>
          (typeof use === 'string' && use.includes('mini-css-extract-plugin')) ||
          (typeof use === 'object' && use.loader && use.loader.includes('mini-css-extract-plugin')),
      );
      if (cssMiniExtractIndex >= 0) {
        rule.use[cssMiniExtractIndex] = { loader: 'style-loader' };
      }
    }
  });
}

function getLibraryName(options: any): string {
  if (options?.customWebpackConfig?.libraryName) {
    return options.customWebpackConfig.libraryName;
  }

  const projectName = getProjectNameFromAngularJson(options);
  if (projectName) return projectName;

  console.warn(
    'Warning: single-spa-angular could not determine a library name to use and has used a default value.',
  );
  console.info('This may cause issues if this app uses code-splitting or lazy loading.');
  if (!options) {
    console.info('You may also need to update extra-webpack.config.json.');
  }
  console.info(
    'See <https://single-spa.js.org/docs/ecosystem-angular/#use-custom-webpack> for information on how to resolve this.',
  );

  return 'angular_single_spa_project';
}

function getProjectNameFromAngularJson(options: any): string | null | undefined {
  const angularJsonPath = findUp(['angular.json', '.angular.json'], process.cwd());
  if (!angularJsonPath) return null;

  const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
  if (!angularJson.projects) return null;

  const projects = Object.keys(angularJson.projects);

  // if there is exactly one project in the workspace, then that must be this one.
  if (projects.length === 1) return projects[0];

  try {
    // If `projects.length > 1` then this means we're inside a monorepo workspace,
    // that might be an Nrwl Nx workspace. The Nx workspace can contain N different Angular applications.
    // In the following code we're trying to find an Nx project by the `main`
    // property which equals `apps/${applicationName}/src/main.single-spa.ts` and `options`
    // are bounded to the currently built application, so their values cannot differ.

    // We search by `architect.build` since any Angular application has an `architect` configuration
    // in `angular.json` and each `architect` has `build` target, thus any application can be built
    // via `ng build application`.
    return projects.find(
      project => angularJson.projects[project].architect.build.options.main === options.main,
    );
  } catch {
    // If we reach here there are multiple (or zero) projects in angular.json
    // we cannot tell which one to use, so we will end up using the default.
    return null;
  }
}
