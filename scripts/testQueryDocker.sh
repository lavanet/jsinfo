#!/bin/bash
docker build -t jsinfo-docker . 
docker run -it jsinfo-docker sh