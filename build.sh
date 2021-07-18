#!/bin/sh

pdflatex -synctex=1 -interaction=nonstopmode -file-line-error main
biber main
pdflatex -synctex=1 -interaction=nonstopmode -file-line-error main
pdflatex -synctex=1 -interaction=nonstopmode -file-line-error main
