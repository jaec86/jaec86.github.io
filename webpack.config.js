const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { execSync } = require('child_process')
const merge = require('webpack-merge')
const TerserJsPlugin = require('terser-webpack-plugin')
const openBrowser = require('react-dev-utils/openBrowser')
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin')
const { prepareUrls } = require('react-dev-utils/WebpackDevServerUtils')
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages')
const prettyMs = require('pretty-ms')
const EventHooksPlugin = require('event-hooks-webpack-plugin')
const chalk = require('chalk')
const _ = require('lodash')

const PROTOCOL = 'http'
const HOST = '0.0.0.0'
const DEFAULT_PORT = '8080'
const PORT = execSync(`detect-port ${DEFAULT_PORT}`).toString().replace(/\D/g, '')
const urls = prepareUrls(PROTOCOL, HOST, PORT)

module.exports = merge.smart(
  {
    entry: './src/js/app.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'app.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
          },
        },
        {
          test: /\.(glsl|frag|vert)$/,
          use: ['raw-loader', 'glslify-loader'],
        },
        {
          test: /\.css$/,
          use: [ 
            {
              loader: MiniCssExtractPlugin.loader,
              options: {
                publicPath: './src/css'
              }
            },
            'css-loader',
            'postcss-loader'
          ]
        },
      ],
    },
    plugins: [
      new CopyPlugin([
        { from: 'src/public' },
      ]),
      new MiniCssExtractPlugin({ filename: 'app.css' })
    ],
    optimization: {
      splitChunks: false,
    },
    performance: false,
    stats: false,
  },
  process.env.NODE_ENV === 'development' && {
    mode: 'development',
    devtool: 'cheap-module-source-map',
    devServer: {
      https: PROTOCOL === 'https',
      host: HOST,
      port: PORT,
      public: urls.lanUrlForConfig,
      publicPath: '/',
      contentBase: './dist',
      watchContentBase: true,
      watchOptions: {
        ignored: /node_modules/,
      },
      writeToDisk: true,
      compress: true,
      quiet: true,
      clientLogLevel: 'none',
      after() {
        openBrowser(urls.localUrlForBrowser)
      },
    },
    plugins: [
      new WatchMissingNodeModulesPlugin('node_modules'),
      new EventHooksPlugin({
        beforeCompile: _.debounce(() => {
          console.clear()
          console.log('⏳  Compiling...')
        }, 0),
        done(stats) {
          if (stats.hasErrors()) {
            const statsJson = stats.toJson({ all: false, warnings: true, errors: true })
            const messages = formatWebpackMessages(statsJson)
            console.clear()
            console.log(chalk.red('❌  Failed to compile.'))
            console.log()
            console.log(messages.errors[0])
            return
          }

          const time = prettyMs(stats.endTime - stats.startTime)
          console.clear()
          console.log(chalk.green(`✅  Compiled successfully in ${chalk.cyan(time)}`))
          console.log()
          console.log(`  ${chalk.bold(`Local`)}:           ${chalk.cyan(urls.localUrlForTerminal)}`)
          console.log(`  ${chalk.bold(`On your network`)}: ${chalk.cyan(urls.lanUrlForTerminal)}`)
        },
      }),
    ],
  },
  process.env.NODE_ENV === 'production' && {
    mode: 'production',
    plugins: [
      new EventHooksPlugin({
        beforeCompile: _.debounce(() => {
          console.log('⏳  Compiling...')
        }, 0),
        done(stats) {
          if (stats.hasErrors()) {
            const statsJson = stats.toJson({ all: false, warnings: true, errors: true })
            const messages = formatWebpackMessages(statsJson)
            console.log(chalk.red('❌  Failed to compile.'))
            console.log()
            console.log(messages.errors[0])
          }
        },
        afterEmit() {
          console.log(chalk.green(`✅  Compiled successfully!`))
          console.log()
        },
      }),
    ],
    optimization: {
      minimizer: [
        new TerserJsPlugin({
          terserOptions: {
            parse: {
              ecma: 8,
            },
            compress: {
              ecma: 5,
            },
            output: {
              ecma: 5,
              ascii_only: true,
            },
          },
          parallel: true,
          cache: true,
        }),
      ],
    },
  }
)
