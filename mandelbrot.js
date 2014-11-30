/*
 * The Mandelbrot Set, in HTML5 canvas and javascript.
 * https://github.com/cslarsen/mandelbrot-js
 *
 * Copyright (C) 2012 Christian Stigen Larsen
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.  You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 */

/*
 * Global variables:
 */
var renderId = 0; // To zoom before current render is finished
window.isDrawing = false;


/*
 * Just a shorthand function: Fetch given element, jQuery-style
 *
function jquerystupidreplacement$(id)
{
  return document.getElementById(id);
}*/


function getSamples()
{
  return 1;
}

/*
 * Main renderer equation.
 *
 * Returns number of iterations and values of Z_{n}^2 = Tr + Ti at the time
 * we either converged (n == iterations) or diverged.  We use these to
 * determined the color at the current pixel.
 *
 * The Mandelbrot set is rendered taking
 *
 *     Z_{n+1} = Z_{n} + C
 *
 * with C = x + iy, based on the "look at" coordinates.
 *
 * The Julia set can be rendered by taking
 *
 *     Z_{0} = C = x + iy
 *     Z_{n+1} = Z_{n} + K
 *
 * for some arbitrary constant K.  The point C for Z_{0} must be the
 * current pixel we're rendering, but K could be based on the "look at"
 * coordinate, or by letting the user select a point on the screen.
 */
function mandelbrotAlgorithm(Cr, Ci, escapeRadius, iterations)
{
  var Zr = 0;
  var Zi = 0;
  var Tr = 0;
  var Ti = 0;
  var n  = 0;

  for ( ; n<iterations && (Tr+Ti)<=escapeRadius; ++n ) {
    Zi = 2 * Zr * Zi + Ci;
    Zr = Tr - Ti + Cr;
    Tr = Zr * Zr;
    Ti = Zi * Zi;
  }

  /*
   * Four more iterations to decrease error term;
   * see http://linas.org/art-gallery/escape/escape.html
   */
  for ( var e=0; e<4; ++e ) {
    Zi = 2 * Zr * Zi + Ci;
    Zr = Tr - Ti + Cr;
    Tr = Zr * Zr;
    Ti = Zi * Zi;
  }

  return [n, Tr, Ti];
}

/*
 * Default Mandelbrot canvas size
 */
var MANDELBROT_CANVAS_SIZE = {top_left: {x: -2.5, y: 1.25}, bottom_right: {x: 1, y: -1.25}};
var MANDELBROT_X_OFFSET = 2.5;
var MANDELBROT_Y_OFFSET = 1.25;
var MANDELBROT_X_RANGE = 3.5;
var MANDELBROT_Y_RANGE = 2.5;


/*
 * Return number with metric units
 */
function metric_units(number)
{
  var unit = ["", "k", "M", "G", "T", "P", "E"];
  var mag = Math.ceil((1+Math.log(number)/Math.log(10))/3);
  return "" + (number/Math.pow(10, 3*(mag-1))).toFixed(2) + unit[mag];
}

/*
 * Convert hue-saturation-value/luminosity to RGB.
 *
 * Input ranges:
 *   H =   [0, 360] (integer degrees)
 *   S = [0.0, 1.0] (float)
 *   V = [0.0, 1.0] (float)
 */
function hsv_to_rgb(h, s, v)
{
  if ( v > 1.0 ) v = 1.0;
  var hp = h/60.0;
  var c = v * s;
  var x = c*(1 - Math.abs((hp % 2) - 1));
  var rgb = [0,0,0];

  if ( 0<=hp && hp<1 ) rgb = [c, x, 0];
  if ( 1<=hp && hp<2 ) rgb = [x, c, 0];
  if ( 2<=hp && hp<3 ) rgb = [0, c, x];
  if ( 3<=hp && hp<4 ) rgb = [0, x, c];
  if ( 4<=hp && hp<5 ) rgb = [x, 0, c];
  if ( 5<=hp && hp<6 ) rgb = [c, 0, x];

  var m = v - c;
  rgb[0] += m;
  rgb[1] += m;
  rgb[2] += m;

  rgb[0] *= 255;
  rgb[1] *= 255;
  rgb[2] *= 255;
  return rgb;
}

/*
 * Adjust aspect ratio based on plot ranges and canvas dimensions.
 */
function adjustAspectRatio(xRange, yRange, canvas)
{
  var ratio = Math.abs(xRange.y-xRange.x) / Math.abs(yRange.y-yRange.x);
  var sratio = canvas.width/canvas.height;
  if ( sratio>ratio ) {
    var xf = sratio/ratio;
    xRange.x *= xf;
    xRange.y *= xf;
      zoom[0] *= xf;
  } else {
    var yf = ratio/sratio;
    yRange.x *= yf;
    yRange.y *= yf;
      zoom[1] *= yf;
  }
}

function addRGB(v, w)
{
  v[0] += w[0];
  v[1] += w[1];
  v[2] += w[2];
  v[3] += w[3];
  return v;
}

function divRGB(v, div)
{
  v[0] /= div;
  v[1] /= div;
  v[2] /= div;
  v[3] /= div;
  return v;
}

/*
 * Render the Mandelbrot set
 */
function draw(canvas, xRange, yRange, pickColor, fractalAlgorithm)
{
  if (!canvas || !xRange || !yRange || !pickColor || !fractalAlgorithm){
    return 0;
  }
  
  if (window.isDrawing) {
    setTimeout(function(){draw(canvas, xRange, yRange, pickColor, fractalAlgorithm);}, 100);
    return 0;
  }
  
  window.isDrawing = true;

  var ctx = canvas.getContext('2d');
  var img = ctx.createImageData(canvas.width, 1);
  
  var superSamples = getSamples();

  //adjustAspectRatio(xRange, yRange, canvas);

  var f = Math.sqrt(
    0.001+2.0 * Math.min(
      Math.abs(xRange.x-xRange.y),
      Math.abs(yRange.x-yRange.y)));

  steps = Math.floor(223.0/f);

  var escapeRadius = Math.pow(parseFloat(10.0), 2.0);
  var dx = (xRange.y - xRange.x) / (0.5 + (canvas.width-1));
  var dy = (yRange.y - yRange.x) / (0.5 + (canvas.height-1));
  var Ci_step = (yRange.y - yRange.x) / (0.5 + (canvas.height-1));

  // Only enable one render at a time
  renderId += 1;

  function drawLineSuperSampled(Ci, off, Cr_init, Cr_step)
  {
    var Cr = Cr_init;

    for ( var x=0; x<canvas.width; ++x, Cr += Cr_step ) {
      var color = [0, 0, 0, 255];

      for ( var s=0; s<superSamples; ++s ) {
        var rx = Math.random()*Cr_step;
        var ry = Math.random()*Ci_step;
        var p = fractalAlgorithm(Cr - rx/2, Ci - ry/2, escapeRadius, steps);
        color = addRGB(color, pickColor(steps, p[0], p[1], p[2]));
      }

      color = divRGB(color, superSamples);

      img.data[off++] = color[0];
      img.data[off++] = color[1];
      img.data[off++] = color[2];
      img.data[off++] = 255;
    }
  }

  function drawLine(Ci, off, Cr_init, Cr_step)
  {
    var Cr = Cr_init;

    for ( var x=0; x<canvas.width; ++x, Cr += Cr_step ) {
      var p = fractalAlgorithm(Cr, Ci, escapeRadius, steps);
      var color = pickColor(steps, p[0], p[1], p[2], Ci, Cr);
      img.data[off++] = color[0];
      img.data[off++] = color[1];
      img.data[off++] = color[2];
      img.data[off++] = 255;
    }
  }

  function drawSolidLine(y, color)
  {
    var off = y*canvas.width;

    for ( var x=0; x<canvas.width; ++x ) {
      img.data[off++] = color[0];
      img.data[off++] = color[1];
      img.data[off++] = color[2];
      img.data[off++] = color[3];
    }
  }

  function render()
  {
    var start  = (new Date).getTime();
    var startHeight = canvas.height;
    var startWidth = canvas.width;
    var lastUpdate = start;
    var updateTimeout = 200;
    var pixels = 0;
    var Ci = yRange.x;
    var sy = 0;
    var drawLineFunc = superSamples>1? drawLineSuperSampled : drawLine;
    var ourRenderId = renderId;

    var scanline = function()
    {
      if (    renderId != ourRenderId ||
           startHeight != canvas.height ||
            startWidth != canvas.width )
      {
        // Stop drawing
        return;
      }

      drawLineFunc(Ci, 0, xRange.x, dx);
      Ci += Ci_step;
      pixels += canvas.width;
      ctx.putImageData(img, 0, sy);

      var now = (new Date).getTime();

      /*
       * Javascript is inherently single-threaded, and the way
       * you yield thread control back to the browser is MYSTERIOUS.
       *
       * People seem to use setTimeout() to yield, which lets us
       * make sure the canvas is updated, so that we can do animations.
       *
       * But if we do that for every scanline, it will take 100x longer
       * to render everything, because of overhead.  So therefore, we'll
       * do something in between.
       */
      if ( sy++ < canvas.height ) {
        if ( (now - lastUpdate) >= updateTimeout ) {
          // show the user where we're rendering
          drawSolidLine(0, [255,59,3,255]);
          ctx.putImageData(img, 0, sy);

          // Update speed and time taken
          var elapsedMS = now - start;
          $('renderTime').innerHTML = (elapsedMS/1000.0).toFixed(1); // 1 comma

          var speed = Math.floor(pixels / elapsedMS);

          if ( metric_units(speed).substr(0,3)=="NaN" ) {
            speed = Math.floor(60.0*pixels / elapsedMS);
            $('renderSpeedUnit').innerHTML = 'minute';
          } else
            $('renderSpeedUnit').innerHTML = 'second';

          $('renderSpeed').innerHTML = metric_units(speed);

          // yield control back to browser, so that canvas is updated
          lastUpdate = now;
          setTimeout(scanline, 0);
        } else
          scanline();
      }
      else{
        window.isDrawing = false;
      }
    };

    // Disallow redrawing while rendering
    scanline();
  }

  render();
}

// Some constants used with smoothColor
var logBase = 1.0 / Math.log(2.0);
var logHalfBase = Math.log(0.5)*logBase;

function smoothColor(steps, n, Tr, Ti)
{
  /*
   * Original smoothing equation is
   *
   * var v = 1 + n - Math.log(Math.log(Math.sqrt(Zr*Zr+Zi*Zi)))/Math.log(2.0);
   *
   * but can be simplified using some elementary logarithm rules to
   */
  return 5 + n - logHalfBase - Math.log(Math.log(Tr+Ti))*logBase;
}

var interiorColor = [0, 0, 0, 255];

function pickColorHSV1Gradient(steps, n, Tr, Ti, Cr, Ci)
{
  if ( n == steps ) // converged?
    return interiorColor;

  var v = smoothColor(steps, n, Tr, Ti);
  var c = hsv_to_rgb(360.0*v/steps, 1.0, 10.0*v/steps);
  // gradient of background pixels along x-axis
  c[0] = (c[0] * (Ci + MANDELBROT_X_OFFSET) / MANDELBROT_X_RANGE) + 
    (c[2] * (MANDELBROT_X_RANGE - Ci - MANDELBROT_X_OFFSET) / MANDELBROT_X_RANGE);
  c[2] = (c[2] * (Ci + MANDELBROT_X_OFFSET) / MANDELBROT_X_RANGE) + 
    (c[0] * (MANDELBROT_X_RANGE - Ci - MANDELBROT_X_OFFSET) / MANDELBROT_X_RANGE);
  // gradient of intensely colored pixels along y-axis
  c[1] = (c[1] * (Cr + MANDELBROT_Y_OFFSET) / MANDELBROT_Y_RANGE) + 
    (c[2] * (MANDELBROT_Y_RANGE - Cr - MANDELBROT_Y_OFFSET) / MANDELBROT_Y_RANGE);
  c[2] = (c[2] * (Cr + MANDELBROT_X_OFFSET) / MANDELBROT_X_RANGE) + 
    (c[1] * (MANDELBROT_Y_RANGE - Cr - MANDELBROT_Y_OFFSET) / MANDELBROT_Y_RANGE);
    
  if (c[0] + c[1] + c[2] > 500){
    c[0] = c[0] * 0.6;
    c[1] = c[1] * 0.6;
    c[2] = c[2] * 0.6;
  }
  
  c.push(255); // alpha
  //c[1] = c[1] * Math.sqrt((Ci + MANDELBROT_X_OFFSET) / MANDELBROT_X_RANGE);
  //c[3] = c[3] * Math.sqrt((Ci + MANDELBROT_Y_OFFSET) / MANDELBROT_Y_RANGE)
  return c;
}

function pickColorHSV1(steps, n, Tr, Ti)
{
  if ( n == steps ) // converged?
    return interiorColor;

  var v = smoothColor(steps, n, Tr, Ti);
  var c = hsv_to_rgb(360.0*v/steps, 1.0, 1.0);
  c.push(255); // alpha
  return c;
}

function pickColorHSV2(steps, n, Tr, Ti)
{
  if ( n == steps ) // converged?
    return interiorColor;

  var v = smoothColor(steps, n, Tr, Ti);
  var c = hsv_to_rgb(360.0*v/steps, 1.0, 10.0*v/steps);
  c.push(255); // alpha
  return c;
}

function pickColorHSV3(steps, n, Tr, Ti)
{
  if ( n == steps ) // converged?
    return interiorColor;

  var v = smoothColor(steps, n, Tr, Ti);
  var c = hsv_to_rgb(360.0*v/steps, 1.0, 10.0*v/steps);

  // swap red and blue
  var t = c[0];
  c[0] = c[2];
  c[2] = t;

  c.push(255); // alpha
  return c;
}

function pickColorGrayscale(steps, n, Tr, Ti)
{
  if ( n == steps ) // converged?
    return interiorColor;

  var v = smoothColor(steps, n, Tr, Ti);
  v = Math.floor(512.0*v/steps);
  if ( v > 255 ) v = 255;
  return [v, v, v, 255];
}

function pickColorGrayscale2(steps, n, Tr, Ti)
{
  if ( n == steps ) { // converged?
    var c = 255 - Math.floor(255.0*Math.sqrt(Tr+Ti)) % 255;
    if ( c < 0 ) c = 0;
    if ( c > 255 ) c = 255;
    return [c, c, c, 255];
  }

  return pickColorGrayscale(steps, n, Tr, Ti);
}
