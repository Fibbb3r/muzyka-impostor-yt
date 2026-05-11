# Zasady gry — Nutki / Impostor (YouTube)

Dokument opisuje tryby dostępne w aplikacji oraz **zasady punktacji** uzgodnione dla rozgrywki. Nie ma **punktów ujemnych** — błędny strzał to zwykle **0 pkt**, nigdy kara „w dół”.

---

## Przebieg rund

1. **Lobby** — gracze dołączają; admin wybiera tryb i uruchamia grę (minimum 2 osoby).
2. **Wybór nutek** — każy gracz podaje jeden link YouTube i moment startu (~30 sekundowy fragment). W trybach z impostorem jedna osoba ma specjalną rolę (patrz niżej).
3. **Gra** — nutki lecą po kolei. Przy każdej można głosować („Kto dodał?” oraz w trybach z impostorem zaznaczenie **To Impostor!** według zasad trybu).
4. **Wyniki** — po każdej nutce pokazywani są autor, głosy i **punkty zdobyte przy tej nutce** przez każdego gracza.

Dodatkowo:

- **Pominięcie nutki** — gracze mogą głosować za pominięciem; po przekroczeniu progu (co najmniej połowa graczy, minimum 1) nutka jest pomijana. Admin może też przejść dalej ręcznie.
- **Czas odsłuchu** — domyślnie ok. 30 sekund na nutkę; tytuł utworu może pojawiać się w trakcie (ujawnianie stopniowe według implementacji aplikacji).

---

## Tryb „Klasyk” (`normal`)

**Cel (dla każdej nutki):** odgadnąć **który gracz dodał** ten fragment.

- Głosowanie odbywa się na polu „Kto dodał?”.
- W tym trybie **nie ma** opcji „To Impostor!”.

---

## Tryb „Impostor” (`impostor`)

**Rola:** losowo wybierana jest jedna osoba — **impostor**. Zna osobę, **pod którą ma się podszywać** („ofiara”). Przy dodawaniu nutki jej wybór powinien brzmieć jak coś, co mogłaby dorzucić osoba pozornie dodająca — zamiast jej nicku przy nutce widoczny jest motyw podszywania (wg aplikacji).

**Głosy:**

- Każdy wskazuje, **kto jego zdaniem dodał** nutkę („Kto dodał?”).
- Dla wybranych decyzji można zaznaczyć **To Impostor!**.
  - W tym trybie, jeśli ktoś uważa, że wybrana osoba naprawdę to impostor, może dodatkowo wskazać **pod kogo się podszywa** (ofiara).

**Ważne ograniczenie w aplikacji:** każdy gracz może użyć zaznaczenia „To Impostor!” **tylko przy jednej nutce** na całą rundę — reszta głosów to tylko wskazanie autora bez pełnego oskarżenia.

---

## Tryb „Słowo Impostor” (`word_impostor`)

**Rola:** jeden gracz to **impostor**, który **nie zna tajnego słowa** znającego resztę pokoju — musi dobierać nutkę bez tej informacji.

- Przy dodawaniu nutki aplikacja może pokazywać inne komunikaty dla nie-impostorów niż dla impostora (np. znane vs nieznane słowo).

**Uwaga dotycząca punktacji:** szczegółowe **punkty za ten tryb** są do ustalenia (planowana rozbudowa mechaniki ze słowem). Do czasu wdrożenia w aplikacji można traktować podsumowanie punktów przy nutce jako wyłączone lub tymczasowe.

---

## Punktacja — wspólne zasady

- Punkty są liczone **osobno za każdą nutkę** i przy podsumowaniu nutki powinny być **widoczne przy każdym graczu** (np. `0 pkt`, `+1 pkt`, `+3 pkt` itd.).
- **Brak wartości ujemnych:** źle wskazany autor / brak trafienia = **0 pkt** (bez kar).
- Przy bonusach za „kto nie wskazał autora przy tej nutce” **nie liczy się** samego siebie jako obiekt porównania — liczą się **inni gracze** względem autora (lub impostora, gdzie dotyczy).

---

## Punktacja — tryb „Klasyk”

| Kto | Co | Punkty (za tę nutkę) |
|-----|-----|----------------------|
| Głosujący | Poprawnie wskazany autor nutki | **+3** |
| Autor nutki | Za każdego **innego** gracza, który przy tej nutce **nie** wskazał Ciebie jako dodającego | **+1** (na każdego takiego gracza) |

Cel bonusu **+1:** nagroda za nutkę „nie po tobie”, którą inni przypisali komuś innemu.

---

## Punktacja — tryb „Impostor”

### Punkty „detektywów” (typowy gracz głosujący)

| Sytuacja | Punkty (za tę nutkę) |
|----------|----------------------|
| Poprawnie wskazany autor nutki (pole „Kto dodał?”) — i **nie** obowiązuje niżej reguła o impostorze | **+3** |
| Zaznaczony impostor (poprawna osoba jako dodająca + „To Impostor!”) **bez** idealnego trafienia ofiary | **+4** |
| **Idealny traf** — poprawnie wskazany impostor **oraz** poprawnie wskazana **ofiara** (pod kogo się podszywa) | **+6** |

**Reguła stackowania (bez podwójnego liczenia przy jednym głosie na tej samej nutce):**

- Jeśli obowiązuje **idealny traf** → liczy się wyłącznie **+6** (bez dodatkowych **+3** / bez traktowania jak osobne **+4**).
- Jeśli obowiązuje częściowe wykrycie impostora (**+4**) → **nie** dodajesz osobno **+3** za samo „kto dodał” przy tym samym układzie głosu na tej nutce.
- W przeciwnym razie, jeśli ktoś tylko trafił **kto faktycznie dodał** utwór bez powyższych wariantów „impostorowych” przy tym głosie → **+3**.

Błędne wskazania i pudła → **0 pkt**.

### Bonus dla autora nutki (gdy nie chodzi o podwojenie przez reguły impostora przy jednym głosie — patrz kod / implementacja)

- Jak w klasycznym: **+1 pkt** za każdego **innego** gracza, który przy Twojej nutce **nie** wskazał Ciebie jako dodającego („kto nie trafił, że to Ty”).

### Bonus dla impostora przy **jego** nutce (nagroda za ukrycie)

- Jeśli dana nutka faktycznie dodana przez **impostora**: **+2 pkt** za każdego **innego** gracza, który przy tej nutce **nie** wskazał **impostora** jako osoby dodającej (czyli `kto dodał` ≠ impostor).

---

## Aktualność dokumentu

Zasady gry mogą ewoluować wraz z aplikacją (np. tryb Słowo Impostor, dokładny UI głosowania). W razie rozbieżności między **tym plikiem** a **implementacją w kodzie** decydująca jest wersja **wdrożona w aplikacji** — warto wtedy zaktualizować ten plik, żeby pozostać zgodnym z kodem.
