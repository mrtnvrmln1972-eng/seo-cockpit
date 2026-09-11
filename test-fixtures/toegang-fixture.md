# Toegang

Wat er gekoppeld is en wat mist. **Nooit wachtwoorden of tokens in dit bestand.**

| Koppeling | Stand | Sinds | Details |
|---|---|---|---|
| Search Console | gekoppeld | | Property `https://www.eerstekamerbadkamers.nl/` (URL-prefix). Via Windsor.ai, connector `searchconsole`. Er is geen domeinproperty `sc-domain:eerstekamerbadkamers.nl`. Op 04-09-2026 is aan Anton, Johan en Hanneke een DNS TXT-record gevraagd om de domeinproperty te kunnen verifiëren; op 08-09-2026 nog geen bevestiging in de mail dat dit record is toegevoegd |
| Ahrefs | gekoppeld, robots.txt weer bereikbaar | 08-09-2026 | Domain Rating 26 op 29-08-2026. De Site Audit-crawl liep tot en met 04-09-2026 vast op robots.txt (health score 0, 1 URL). Op 08-09-2026 gecontroleerd: nieuwste crawl gedateerd 05-09-2026, status Completed, 566 URL's gecrawld, health score 60, 229 URL's met fouten, 279 met waarschuwingen, 309 met notices. Robots.txt is dus tussen 04-09 en 05-09-2026 weer bereikbaar geworden. Wie dat heeft opgelost en waarom is niet bekend; issue-detail van deze crawl is nog niet doorgenomen |
| Google Analytics 4 | gekoppeld | 04-09-2026 | Property `eerstekamerbadkamers.nl - GA4` (id 333656981), via Windsor.ai, connector `googleanalytics4`. Gecontroleerd in Windsor: het account staat er nu echt aan gekoppeld. Op 27-08-2026 is bij Hanneke (Sparklet) ook los om Analytics-toegang gevraagd; op 08-09-2026 geen bevestiging in de mail gevonden of die toegang er ook is, dus navragen of dit hetzelfde is als de Windsor-koppeling |
| Google Ads | toegang bekend, nog niet gekoppeld aan Windsor | 04-09-2026 | Toegang loopt via het vaste Pingwin-account pingwinadwordsmcc@gmail.com, beheerd door de Google Ads-beheerder. Windsor.ai heeft dit nog niet gekoppeld. Koppelen: [Windsor, Google Ads koppelen](https://onboard.windsor.ai/connect?connector=google_ads&next=/google_ads/authorize), inloggen met pingwinadwordsmcc@gmail.com. Los daarvan loopt er een Ads-herinrichting: analyse verstuurd aan Anton op 03-09-2026, tijdspad van circa twee weken genoemd, Tiemen (Gladior) is gevraagd om klikbudget-advies en een datum, daar nog geen reactie op ontvangen (peildatum 08-09-2026) |
| WordPress | gekoppeld, schrijftoegang mist | | Gemeten op 30-08-2026. WordPress met Yoast SEO 28.0, `wp-json` bereikbaar. De namespace `pingwin/v1` bestaat nog niet, dus `pingwin-seo-rest.php` staat er nog niet. Op 11-08-2026 is bij Johan van As gevraagd om toegang tot de tools en de website; op 08-09-2026 geen bevestiging in de mail gevonden dat die toegang er is. Tot schrijftoegang er is: titel en meta description gaan handmatig via de sitebouwer in Yoast. Elementor: niet gemeten |
| Google Bedrijfsprofiel | uitnodiging geaccepteerd, nog niet gekoppeld aan Windsor | 04-09-2026 | Marketing Sparklet nodigde mrtnvrmln1972@gmail.com uit als eigenaar van "De Eerste Kamer", 26-08-2026, geaccepteerd. Los daarvan is op 27-08-2026 bij Hanneke apart om beheerderstoegang gevraagd; op 08-09-2026 geen bevestiging gevonden dat die is verleend. In Windsor nog geen gekoppeld account. Koppelen: [Windsor, Bedrijfsprofiel koppelen](https://onboard.windsor.ai/connect?connector=google_my_business&next=/google_my_business/authorize) |
| Microsoft Clarity | niet van toepassing | 04-09-2026 | |
| Screaming Frog-crawl | twee crawls, de nieuwste nog niet verwerkt | 08-09-2026 | De crawl van 03-09-2026 (323 adressen, export `internal_html.csv`) is verwerkt in roadmap.md en signalen.md van 04-09-2026. Op 08-09-2026 heeft Maarten zelf een nieuwe, rijkere export geüpload in de chat: `internal_all.csv`, crawl-timestamp 08-09-2026, 468 unieke adressen (466x 200, 2x 301, geen enkele fout), met onder meer structured data, near-duplicates en semantische gelijkenis erin. Deze export staat nog niet in roadmap.md of signalen.md verwerkt; dat is aparte vervolgstap |
| Fotodrive | gekoppeld | 07-09-2026 | Moniek bevestigde dat pingwinonline@gmail.com en pingwinadwordsmcc@gmail.com zijn toegevoegd aan de fotodatabase, plus een map met videomateriaal |

## Geschiedenis

Bijgewerkt op 29-08-2026 op basis van de vindbaarheidsscan van die dag.

Aangevuld op 30-08-2026 met de Search Console-meting en de WordPress-meting van die dag.

Aangevuld op 02-09-2026 met een verse meting: Ahrefs Site Audit, Search Console via Windsor.ai, de connectorlijst van Windsor.ai en een directe ophaal van robots.txt.

Aangevuld op 04-09-2026: GA4-property bevestigd via de Analytics-omgeving van Maarten en later diezelfde dag gecontroleerd als echt gekoppeld in Windsor. Google Ads-toegang via het vaste MCC-account pingwinadwordsmcc@gmail.com, met de vraag of dit ook via Maartens eigen Gmail kan. De Bedrijfsprofiel-uitnodiging van Sparklet teruggevonden in de mail en later diezelfde dag door Maarten geaccepteerd, nog niet gekoppeld in Windsor. De Screaming Frog-crawl gemarkeerd als verwerkt.

Aangevuld op 08-09-2026: Ahrefs Site Audit opnieuw gecontroleerd, robots.txt blijkt tussen 04-09 en 05-09-2026 weer bereikbaar te zijn geworden, nieuwe crawl van 566 URL's met health score 60 staat klaar. De mailbox doorgenomen op openstaande toegangsverzoeken: DNS TXT-record voor de Search Console-domeinproperty (gevraagd 04-09, geen bevestiging), WordPress-toegang bij Johan van As (gevraagd 11-08, geen bevestiging), beheerderstoegang Google Mijn Bedrijf en Analytics bij Hanneke (gevraagd 27-08, geen bevestiging). Later diezelfde dag: Maarten uploadde zelf een nieuwe, rijkere Screaming Frog-export (`internal_all.csv`, 468 adressen), nog niet verwerkt in roadmap.md of signalen.md. De propositiemail (taak 1) is voor het eerst als concept klaargezet, met de Variant B-zin uit klant.md in plaats van de Variant A-zin die het vorige concept en toelichting.md abusievelijk citeerden.

## robots.txt bereikbaar

Sinds 05-09-2026 weer ja, blijkens de geslaagde Ahrefs-crawl van die datum. Tot en met 04-09-2026 nee: gemeten op 02-09-2026 en nogmaals op 04-09-2026 vanuit twee onafhankelijke kanten (Ahrefs kwam er niet bij, een directe ophaal van `https://www.eerstekamerbadkamers.nl/robots.txt` liep op een ConnectTimeout). Wie dit heeft opgelost is niet bekend; navragen bij de sitebouwer of hoster is daarmee niet meer nodig, controleren of dit blijvend is wel.

## Openstaand

1. **Ahrefs-crawl van 05-09-2026 doornemen.** 229 URL's met fouten, 279 met waarschuwingen: nog niet bekeken wat dit zijn
2. **Nieuwe Screaming Frog-export van 08-09-2026 verwerken** in roadmap.md en signalen.md: rijker dan de crawl van 03-09, onder meer met structured data en near-duplicates
3. **DNS TXT-record voor de Search Console-domeinproperty.** Gevraagd op 04-09-2026 aan Anton, Johan en Hanneke, nog geen bevestiging. Zonder domeinproperty blijft Search Console beperkt tot het www-adres
4. WordPress-schrijftoegang regelen. Gevraagd op 11-08-2026 bij Johan van As, nog geen bevestiging. Zonder dit blijft titel en meta description handwerk via de sitebouwer
5. Google Ads koppelen aan Windsor.ai, met de link hierboven en het account pingwinadwordsmcc@gmail.com
6. Bedrijfsprofiel koppelen aan Windsor.ai, met de link hierboven, en navragen of de apart gevraagde beheerderstoegang bij Hanneke er inmiddels is
7. Analytics-toegang bij Hanneke navragen: staat los van de Windsor-koppeling die al werkt, dus checken of dit hetzelfde is of nog een tweede ding
8. Kiezen wat er als eerste komt voor WordPress: `pingwin-seo-rest.php` op de site plaatsen plus een applicatie-wachtwoord (route A), of SSH met WP-CLI regelen (route B)
9. Elementor: nagaan of de site Elementor gebruikt. Dat is op 30-08-2026 niet gemeten
10. Google Ads-herinrichting: Tiemen (Gladior) is op 02-09-2026 gevraagd om een tijdspad en klikbudget-advies, daar nog geen antwoord op

## Wat hiervan naar de klant moet

Punt 3 (DNS TXT-record) en punt 4 (WordPress-toegang) staan al bij Anton, Johan en Hanneke uit en wachten op hun actie. De rest is Pingwin-werk: koppelen aan Windsor.ai, navragen of eerder gevraagde toegang inmiddels is verleend, of de nieuwe crawl verwerken.
