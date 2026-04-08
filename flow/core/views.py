from django.shortcuts import render


def home(request):
    return render(request, "home.html")


def profession_choice(request):
    return render(request, "profession_choice.html")

