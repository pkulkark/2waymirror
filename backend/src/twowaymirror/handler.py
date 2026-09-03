"""AWS Lambda entry point."""

from mangum import Mangum

from twowaymirror.main import app

handler = Mangum(app, lifespan="off")
