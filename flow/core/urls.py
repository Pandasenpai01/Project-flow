from django.urls import path

from . import views

urlpatterns = [
    path("", views.profession_choice, name="profession_choice"),
    path("home/", views.home, name="home"),
]

