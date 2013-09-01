module.exports = function (grunt) {
  // load all grunt tasks
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  grunt.initConfig({
    watch: {
      pegs: {
        files: ['src/*.peg'],
        tasks: ['peg'],
      }
    },
    peg: {
      fbp: {
        src: 'src/fbp.peg',
        dest: '.tmp/fbpParser.js',
        options: { exportVar: "fbpParser" }
      }
    },
    concat: {
      options: {
        separator: ';',
        banner: '(function(angular, window, document, undefined) {"use strict";',
        footer: '})(angular, window, document);'
      },
      dist: {
        src: ['src/angular-flo.js', '.tmp/fbpParser.js'],
        dest: 'angular-flo.js',
      },
    },
    ngmin: {
      dist: {
        files: {
          'angular-flo.min.js': [
            'angular-flo.js'
          ]
        }
      }
    },
    uglify: {
      dist: {
        files: {
          'angular-flo.min.js': [
            'angular-flo.js'
          ]
        }
      }
    }
  });

  grunt.registerTask('develop', [
    'peg',
    'watch'
  ]);

  grunt.registerTask('build', [
    'peg',
    'concat',
    'ngmin',
    'uglify'
  ]);
};
